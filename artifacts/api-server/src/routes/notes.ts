import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, ticketInternalNotesTable, ticketsTable, usersTable, ticketActivityLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { AddTicketNoteBody } from "@workspace/api-zod";
import { hasGroupPermission } from "../lib/groupPermissions";

const router: IRouter = Router();

async function requireNoteAccess(req: any, res: any, next: any): Promise<void> {
  const user = req.currentUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const allowed = await hasGroupPermission(user.id, user.organizationId, "add_notes", user.role === "admin");
  if (!allowed) { res.status(403).json({ error: "Forbidden" }); return; }
  next();
}

router.get("/tickets/:id/notes", requireAuth, requireNoteAccess, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const [ticket] = await db.select({ id: ticketsTable.id, visibility: ticketsTable.visibility }).from(ticketsTable).where(
    and(eq(ticketsTable.id, id), isNull(ticketsTable.deletedAt), orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined)
  );
  if (!ticket || (currentUser.role !== "admin" && ticket.visibility === "admins")) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

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

router.post("/tickets/:id/notes", requireAuth, requireNoteAccess, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = AddTicketNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const currentUser = (req as any).currentUser;
  const orgId = currentUser.organizationId;

  const [ticket] = await db.select({ id: ticketsTable.id, visibility: ticketsTable.visibility }).from(ticketsTable).where(
    and(eq(ticketsTable.id, id), isNull(ticketsTable.deletedAt), orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined)
  );
  if (!ticket || (currentUser.role !== "admin" && ticket.visibility === "admins")) {
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
