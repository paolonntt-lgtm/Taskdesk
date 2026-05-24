import { Router, type IRouter } from "express";
import { eq, inArray, and, sql } from "drizzle-orm";
import { db, ticketCommentsTable, ticketsTable, usersTable, ticketActivityLogsTable, commentReactionsTable, inboundEmailChannelsTable, ticketAttachmentsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/auth";
import { AddTicketCommentBody, UpdateTicketCommentBody } from "@workspace/api-zod";
import { createNotificationsForTicket, createNotificationForUser } from "../lib/notifications";
import { sendEmailForOrg, buildTicketReplyEmail } from "../lib/email";
import { appBaseUrl } from "../lib/appUrl";
import { ObjectStorageService } from "../lib/objectStorage";
import { consumePendingUpload } from "../lib/pendingUploads";

const objectStorageService = new ObjectStorageService();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function channelReplyTo(ch: { token: string; slug: string | null }, domain: string): string {
  const localPart = ch.slug ?? `tickets-${ch.token}`;
  return `${localPart}@${domain}`;
}

async function getOrgInboundEmail(orgId: number | null, inboundChannelId?: number | null): Promise<string | null> {
  if (!orgId) return null;
  const domain = process.env.INBOUND_EMAIL_DOMAIN ?? "inbound.taskdesk.it";

  if (inboundChannelId) {
    try {
      const [ch] = await db
        .select({ token: inboundEmailChannelsTable.token, slug: inboundEmailChannelsTable.slug })
        .from(inboundEmailChannelsTable)
        .where(and(eq(inboundEmailChannelsTable.id, inboundChannelId), eq(inboundEmailChannelsTable.organizationId, orgId)));
      if (ch) return channelReplyTo(ch, domain);
    } catch { /* ignore */ }
  }

  try {
    const [ch] = await db
      .select({ token: inboundEmailChannelsTable.token, slug: inboundEmailChannelsTable.slug })
      .from(inboundEmailChannelsTable)
      .where(and(eq(inboundEmailChannelsTable.organizationId, orgId), eq(inboundEmailChannelsTable.enabled, true)))
      .limit(1);
    if (ch) return channelReplyTo(ch, domain);
  } catch { /* ignore */ }

  return null;
}

function extractMentionedNames(text: string): string[] {
  const matches = text.matchAll(/@\[([^\]]+)\]/g);
  return [...matches].map((m) => m[1]);
}

async function getReactionsForComments(commentIds: number[], currentUserId: number) {
  if (commentIds.length === 0) return new Map<number, { emoji: string; count: number; userReacted: boolean; users: string[] }[]>();

  const rows = await db
    .select({
      commentId: commentReactionsTable.commentId,
      emoji: commentReactionsTable.emoji,
      userId: commentReactionsTable.userId,
      userName: usersTable.name,
    })
    .from(commentReactionsTable)
    .leftJoin(usersTable, eq(commentReactionsTable.userId, usersTable.id))
    .where(inArray(commentReactionsTable.commentId, commentIds));

  const map = new Map<number, Map<string, { count: number; userReacted: boolean; users: string[] }>>();
  for (const row of rows) {
    if (!map.has(row.commentId)) map.set(row.commentId, new Map());
    const emojiMap = map.get(row.commentId)!;
    if (!emojiMap.has(row.emoji)) emojiMap.set(row.emoji, { count: 0, userReacted: false, users: [] });
    const entry = emojiMap.get(row.emoji)!;
    entry.count += 1;
    if (row.userId === currentUserId) entry.userReacted = true;
    if (row.userName) entry.users.push(row.userName);
  }

  const result = new Map<number, { emoji: string; count: number; userReacted: boolean; users: string[] }[]>();
  for (const [commentId, emojiMap] of map.entries()) {
    result.set(commentId, [...emojiMap.entries()].map(([emoji, data]) => ({
      emoji,
      ...data,
      users: [...data.users].sort((a, b) => a.localeCompare(b)),
    })));
  }
  return result;
}

const router: IRouter = Router();

router.get("/tickets/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const [ticket] = await db.select({ id: ticketsTable.id }).from(ticketsTable).where(
    and(eq(ticketsTable.id, id), orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined)
  );
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const comments = await db
    .select()
    .from(ticketCommentsTable)
    .where(eq(ticketCommentsTable.ticketId, id))
    .orderBy(ticketCommentsTable.createdAt);

  const authorIds = [...new Set(comments.map((c) => c.authorId))];
  const usersResult = authorIds.length > 0
    ? await db
        .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, mainLocation: usersTable.mainLocation, createdAt: usersTable.createdAt, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(inArray(usersTable.id, authorIds))
    : [];
  const userMap = new Map(usersResult.map((u) => [u.id, u]));

  const commentIds = comments.map((c) => c.id);
  const reactionsMap = await getReactionsForComments(commentIds, currentUser.id);

  res.json(comments.map((c) => ({
    ...c,
    author: userMap.get(c.authorId)!,
    reactions: reactionsMap.get(c.id) ?? [],
  })));
});

router.post("/tickets/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = AddTicketCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const [ticket] = await db.select().from(ticketsTable).where(
    and(eq(ticketsTable.id, id), orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined)
  );
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (ticket.status === "closed") {
    res.status(403).json({ error: "Ticket chiuso. Riaprilo prima di aggiungere nuovi commenti." });
    return;
  }

  const [comment] = await db.insert(ticketCommentsTable).values({
    ticketId: id,
    authorId: currentUser.id,
    commentText: parsed.data.commentText,
    replyToCommentId: parsed.data.replyToCommentId ?? null,
  }).returning();

  await db.update(ticketsTable).set({ updatedAt: new Date() }).where(eq(ticketsTable.id, id));

  await db.insert(ticketActivityLogsTable).values({
    ticketId: id,
    userId: currentUser.id,
    actionType: "comment_added",
    actionDescription: `Commento aggiunto da ${currentUser.name}`,
  });

  await createNotificationsForTicket(id, `${currentUser.name} ha commentato il ticket #${id}: "${ticket.title}"`, currentUser.id, "ticket_commented", ticket.organizationId);

  // Validate and consume pending upload tokens for any email reply attachments
  interface EmailReplyAttachment { objectPath: string; fileName: string; fileSize: number; mimeType: string; }
  const emailReplyAttachments: EmailReplyAttachment[] = [];
  if (req.body.sendToCustomer === true && Array.isArray(req.body.emailAttachments)) {
    for (const att of req.body.emailAttachments as unknown[]) {
      if (
        att !== null && typeof att === "object" &&
        typeof (att as any).objectPath === "string" &&
        typeof (att as any).fileName === "string" &&
        typeof (att as any).fileSize === "number" &&
        typeof (att as any).mimeType === "string"
      ) {
        const { objectPath, fileName, fileSize, mimeType } = att as EmailReplyAttachment;
        const owned = consumePendingUpload(objectPath, currentUser.id, orgId ?? null);
        if (owned) emailReplyAttachments.push({ objectPath, fileName, fileSize, mimeType });
      }
    }
  }

  // Persist email reply attachments to ticket_attachments, linked to this comment
  if (emailReplyAttachments.length > 0) {
    await db.insert(ticketAttachmentsTable).values(
      emailReplyAttachments.map((a) => ({
        ticketId: id,
        commentId: comment.id,
        uploadedBy: currentUser.id,
        objectPath: a.objectPath,
        fileName: a.fileName,
        fileSize: a.fileSize,
        mimeType: a.mimeType,
      }))
    );
  }

  // Send email reply to the original customer if requested
  if (req.body.sendToCustomer === true && ticket.resource && EMAIL_RE.test(ticket.resource)) {
    const toEmail = ticket.resource;
    const toName = toEmail.split("@")[0].replace(/[._-]+/g, " ");
    const plainText = parsed.data.commentText
      .replace(/@\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
      .trim();
    const { subject, html, text } = buildTicketReplyEmail({
      toName,
      ticketNumber: ticket.ticketNumber ?? ticket.id,
      ticketTitle: ticket.title,
      replyText: plainText,
      operatorName: currentUser.name,
      appBaseUrl: appBaseUrl(),
    });
    const prevMessageId = ticket.emailMessageId ?? undefined;
    const attachmentsForEmail = [...emailReplyAttachments];
    void (async () => {
      try {
        const replyTo = await getOrgInboundEmail(ticket.organizationId, ticket.inboundChannelId);

        // Fetch file buffers for any attachments
        const nodemailerAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
        for (const att of attachmentsForEmail) {
          try {
            const objectFile = await objectStorageService.getObjectEntityFile(att.objectPath);
            const [buffer] = await objectFile.download();
            nodemailerAttachments.push({ filename: att.fileName, content: buffer as Buffer, contentType: att.mimeType });
          } catch (fetchErr: unknown) {
            const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            logger.warn({ objectPath: att.objectPath, err: msg }, "Failed to fetch attachment for email reply");
          }
        }

        const result = await sendEmailForOrg(ticket.organizationId, {
          to: toEmail,
          subject,
          html,
          text,
          ...(replyTo ? { replyTo } : {}),
          ...(prevMessageId ? { inReplyTo: prevMessageId, references: prevMessageId } : {}),
          ...(nodemailerAttachments.length > 0 ? { attachments: nodemailerAttachments } : {}),
        });
        if (result.ok && result.messageId) {
          await db.update(ticketsTable)
            .set({ emailMessageId: result.messageId })
            .where(eq(ticketsTable.id, id));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn({ ticketId: id, err: msg }, "Failed to send operator email reply");
      }
    })();
    // Log the email dispatch as a separate activity entry
    await db.insert(ticketActivityLogsTable).values({
      ticketId: id,
      userId: currentUser.id,
      actionType: "email_reply_sent",
      actionDescription: `${currentUser.name} ha inviato una risposta via email a ${toEmail}${emailReplyAttachments.length > 0 ? ` con ${emailReplyAttachments.length} allegato/i` : ""}`,
    });
  }

  // Send targeted notifications to mentioned users
  const mentionedNames = extractMentionedNames(parsed.data.commentText);
  if (mentionedNames.length > 0) {
    const orgId = currentUser.organizationId;
    const orgUsers = orgId != null
      ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(eq(usersTable.organizationId, orgId))
      : [];
    for (const mentionedName of mentionedNames) {
      const mentioned = orgUsers.find((u) => u.name === mentionedName);
      if (mentioned && mentioned.id !== currentUser.id) {
        void createNotificationForUser(
          mentioned.id,
          id,
          `${currentUser.name} ti ha menzionato nel ticket #${id}: "${ticket.title}"`,
          "ticket_commented"
        );
      }
    }
  }

  const { passwordHash: _, ...safeUser } = currentUser;
  res.status(201).json({ ...comment, author: safeUser, reactions: [] });
});

router.patch("/tickets/:id/comments/:commentId", requireAuth, async (req, res): Promise<void> => {
  const ticketId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const commentId = parseInt(Array.isArray(req.params.commentId) ? req.params.commentId[0] : req.params.commentId, 10);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const [ticket] = await db.select({ id: ticketsTable.id }).from(ticketsTable).where(
    and(eq(ticketsTable.id, ticketId), orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined)
  );
  if (!ticket) {
    res.status(404).json({ error: "Ticket non trovato" });
    return;
  }

  const [comment] = await db
    .select()
    .from(ticketCommentsTable)
    .where(and(eq(ticketCommentsTable.id, commentId), eq(ticketCommentsTable.ticketId, ticketId)));

  if (!comment) {
    res.status(404).json({ error: "Commento non trovato" });
    return;
  }

  const isAdmin = currentUser.role === "admin";
  const isAuthor = comment.authorId === currentUser.id;
  if (!isAdmin && !isAuthor) {
    res.status(403).json({ error: "Non autorizzato" });
    return;
  }

  const parsed = UpdateTicketCommentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const [updated] = await db
    .update(ticketCommentsTable)
    .set({ commentText: parsed.data.commentText, updatedAt: new Date() })
    .where(eq(ticketCommentsTable.id, commentId))
    .returning();

  const authorResult = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, mainLocation: usersTable.mainLocation, createdAt: usersTable.createdAt, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, updated.authorId));

  await db.update(ticketsTable).set({ updatedAt: new Date() }).where(eq(ticketsTable.id, ticketId));

  await db.insert(ticketActivityLogsTable).values({
    ticketId,
    userId: currentUser.id,
    actionType: "comment_edited",
    actionDescription: `${currentUser.name} ha modificato un commento`,
  });

  const reactionsMap = await getReactionsForComments([updated.id], currentUser.id);
  res.json({ ...updated, author: authorResult[0], reactions: reactionsMap.get(updated.id) ?? [] });
});

router.delete("/tickets/:id/comments/:commentId", requireAuth, async (req, res): Promise<void> => {
  const ticketId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const commentId = parseInt(Array.isArray(req.params.commentId) ? req.params.commentId[0] : req.params.commentId, 10);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const [ticket] = await db.select({ id: ticketsTable.id }).from(ticketsTable).where(
    and(eq(ticketsTable.id, ticketId), orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined)
  );
  if (!ticket) {
    res.status(404).json({ error: "Ticket non trovato" });
    return;
  }

  const [comment] = await db
    .select()
    .from(ticketCommentsTable)
    .where(and(eq(ticketCommentsTable.id, commentId), eq(ticketCommentsTable.ticketId, ticketId)));

  if (!comment) {
    res.status(404).json({ error: "Commento non trovato" });
    return;
  }

  const isAdmin = currentUser.role === "admin";
  const isAuthor = comment.authorId === currentUser.id;
  if (!isAdmin && !isAuthor) {
    res.status(403).json({ error: "Non autorizzato" });
    return;
  }

  await db.delete(ticketCommentsTable).where(eq(ticketCommentsTable.id, commentId));

  await db.update(ticketsTable).set({ updatedAt: new Date() }).where(eq(ticketsTable.id, ticketId));

  await db.insert(ticketActivityLogsTable).values({
    ticketId,
    userId: currentUser.id,
    actionType: "comment_deleted",
    actionDescription: `${currentUser.name} ha eliminato un commento`,
  });

  res.status(204).send();
});

router.patch("/tickets/:id/comments/:commentId/solution", requireAuth, async (req, res): Promise<void> => {
  const ticketId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const commentId = parseInt(Array.isArray(req.params.commentId) ? req.params.commentId[0] : req.params.commentId, 10);
  const currentUser = (req as any).currentUser;

  const orgId = currentUser.organizationId;
  const [ticket] = await db.select().from(ticketsTable).where(
    and(eq(ticketsTable.id, ticketId), orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined)
  );
  if (!ticket) {
    res.status(404).json({ error: "Ticket non trovato" });
    return;
  }

  const canMark = currentUser.role === "admin" || ticket.assignedTo === currentUser.id || ticket.createdBy === currentUser.id;
  if (!canMark) {
    res.status(403).json({ error: "Non autorizzato" });
    return;
  }

  const [comment] = await db
    .select()
    .from(ticketCommentsTable)
    .where(and(eq(ticketCommentsTable.id, commentId), eq(ticketCommentsTable.ticketId, ticketId)));

  if (!comment) {
    res.status(404).json({ error: "Commento non trovato" });
    return;
  }

  const newValue = !comment.isSolution;

  // Clear solution from all comments of this ticket first
  await db
    .update(ticketCommentsTable)
    .set({ isSolution: false })
    .where(eq(ticketCommentsTable.ticketId, ticketId));

  // Then set this one if toggling on
  if (newValue) {
    await db
      .update(ticketCommentsTable)
      .set({ isSolution: true })
      .where(eq(ticketCommentsTable.id, commentId));

    // Auto-resolve ticket if not already resolved/closed
    if (ticket.status !== "resolved" && ticket.status !== "closed") {
      await db
        .update(ticketsTable)
        .set({ status: "resolved", updatedAt: new Date() })
        .where(eq(ticketsTable.id, ticketId));

      await db.insert(ticketActivityLogsTable).values({
        ticketId,
        userId: currentUser.id,
        actionType: "status_changed",
        actionDescription: `${currentUser.name} ha cambiato lo stato in Risolto (soluzione trovata)`,
      });
    }
  }

  await db.insert(ticketActivityLogsTable).values({
    ticketId,
    userId: currentUser.id,
    actionType: "solution_marked",
    actionDescription: newValue
      ? `${currentUser.name} ha segnato un commento come soluzione`
      : `${currentUser.name} ha rimosso il contrassegno di soluzione`,
  });

  res.json({ commentId, isSolution: newValue, autoResolved: newValue && ticket.status !== "resolved" && ticket.status !== "closed" });
});

router.post("/tickets/:id/comments/:commentId/reactions", requireAuth, async (req, res): Promise<void> => {
  const ticketId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const commentId = parseInt(Array.isArray(req.params.commentId) ? req.params.commentId[0] : req.params.commentId, 10);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const { emoji } = req.body;
  const ALLOWED_EMOJIS = ["👍", "✅", "🎉", "❤️", "😂", "🙏"];
  if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
    res.status(400).json({ error: "Emoji non valida" });
    return;
  }

  const [ticket] = await db.select({ id: ticketsTable.id }).from(ticketsTable).where(
    and(eq(ticketsTable.id, ticketId), orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined)
  );
  if (!ticket) {
    res.status(404).json({ error: "Ticket non trovato" });
    return;
  }

  const [comment] = await db
    .select({ id: ticketCommentsTable.id })
    .from(ticketCommentsTable)
    .where(and(eq(ticketCommentsTable.id, commentId), eq(ticketCommentsTable.ticketId, ticketId)));

  if (!comment) {
    res.status(404).json({ error: "Commento non trovato" });
    return;
  }

  // Check if the user has already reacted with this emoji — if so, remove it (toggle)
  const [existing] = await db
    .select()
    .from(commentReactionsTable)
    .where(
      and(
        eq(commentReactionsTable.commentId, commentId),
        eq(commentReactionsTable.userId, currentUser.id),
        eq(commentReactionsTable.emoji, emoji)
      )
    );

  if (existing) {
    await db.delete(commentReactionsTable).where(
      and(
        eq(commentReactionsTable.commentId, commentId),
        eq(commentReactionsTable.userId, currentUser.id),
        eq(commentReactionsTable.emoji, emoji)
      )
    );
  } else {
    await db.insert(commentReactionsTable).values({
      commentId,
      userId: currentUser.id,
      emoji,
    });
  }

  // Return updated reactions for this comment
  const reactionsMap = await getReactionsForComments([commentId], currentUser.id);
  const reactions = reactionsMap.get(commentId) ?? [];
  res.json({ reactions });
});

export default router;
