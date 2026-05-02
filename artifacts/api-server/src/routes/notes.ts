import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ticketInternalNotesTable, ticketsTable, usersTable, ticketActivityLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { AddTicketNoteBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tickets/:id/notes", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const notes = await db
    .select()
    .from(ticketInternalNotesTable)
    .where(eq(ticketInternalNotesTable.ticketId, id))
    .orderBy(ticketInternalNotesTable.createdAt);

  const authorIds = [...new Set(notes.map((n) => n.authorId))];
  const usersResult = await Promise.all(
    authorIds.map((aid) =>
      db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, mainLocation: usersTable.mainLocation, createdAt: usersTable.createdAt })
        .from(usersTable).where(eq(usersTable.id, aid))
        .then(([u]) => u)
    )
  );
  const userMap = new Map(usersResult.filter(Boolean).map((u) => [u.id, u]));

  res.json(notes.map((n) => ({ ...n, author: userMap.get(n.authorId)! })));
});

router.post("/tickets/:id/notes", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = AddTicketNoteBody.safeParse(req.body);
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

  const [note] = await db.insert(ticketInternalNotesTable).values({
    ticketId: id,
    authorId: currentUser.id,
    noteText: parsed.data.noteText,
  }).returning();

  await db.update(ticketsTable).set({ updatedAt: new Date() }).where(eq(ticketsTable.id, id));

  await db.insert(ticketActivityLogsTable).values({
    ticketId: id,
    userId: currentUser.id,
    actionType: "note_added",
    actionDescription: `Nota interna aggiunta da ${currentUser.name}`,
  });

  const { passwordHash: _, ...safeUser } = currentUser;
  res.status(201).json({ ...note, author: safeUser });
});

export default router;
