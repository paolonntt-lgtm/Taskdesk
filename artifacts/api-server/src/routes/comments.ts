import { Router, type IRouter } from "express";
import { eq, inArray, and, sql } from "drizzle-orm";
import { db, ticketCommentsTable, ticketsTable, usersTable, ticketActivityLogsTable, commentReactionsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { AddTicketCommentBody, UpdateTicketCommentBody } from "@workspace/api-zod";
import { createNotificationsForTicket, createNotificationForUser } from "../lib/notifications";

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
