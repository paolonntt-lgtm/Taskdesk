import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, ticketCommentsTable, ticketsTable, usersTable, ticketActivityLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { AddTicketCommentBody } from "@workspace/api-zod";
import { createNotificationsForTicket } from "../lib/notifications";

const router: IRouter = Router();

router.get("/tickets/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const comments = await db
    .select()
    .from(ticketCommentsTable)
    .where(eq(ticketCommentsTable.ticketId, id))
    .orderBy(ticketCommentsTable.createdAt);

  const authorIds = [...new Set(comments.map((c) => c.authorId))];
  const usersResult = authorIds.length > 0
    ? await db
        .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, mainLocation: usersTable.mainLocation, createdAt: usersTable.createdAt })
        .from(usersTable)
        .where(inArray(usersTable.id, authorIds))
    : [];
  const userMap = new Map(usersResult.map((u) => [u.id, u]));

  res.json(comments.map((c) => ({ ...c, author: userMap.get(c.authorId)! })));
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

  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id));
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const [comment] = await db.insert(ticketCommentsTable).values({
    ticketId: id,
    authorId: currentUser.id,
    commentText: parsed.data.commentText,
  }).returning();

  await db.update(ticketsTable).set({ updatedAt: new Date() }).where(eq(ticketsTable.id, id));

  await db.insert(ticketActivityLogsTable).values({
    ticketId: id,
    userId: currentUser.id,
    actionType: "comment_added",
    actionDescription: `Commento aggiunto da ${currentUser.name}`,
  });

  await createNotificationsForTicket(id, `Nuovo commento sul ticket #${id}`, currentUser.id, "ticket_commented");

  const { passwordHash: _, ...safeUser } = currentUser;
  res.status(201).json({ ...comment, author: safeUser });
});

export default router;
