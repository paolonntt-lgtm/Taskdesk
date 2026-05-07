import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, ticketInternalNotesTable, ticketsTable, usersTable, ticketActivityLogsTable, settingsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { AddTicketNoteBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function hasGroupPermission(currentUser: any, permission: string): Promise<boolean> {
  if (currentUser.role === "admin") return true;
  let userGroups: string[] = [];
  try { userGroups = currentUser.groups ? JSON.parse(currentUser.groups) : []; } catch { return false; }
  if (userGroups.length === 0 || currentUser.organizationId == null) return false;
  const key = `org_${currentUser.organizationId}_group_permissions`;
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
  if (!row) return false;
  try {
    const perms: Record<string, string[]> = JSON.parse(row.value);
    return userGroups.some((g) => (perms[g] ?? []).includes(permission));
  } catch { return false; }
}

async function requireNoteAccess(req: any, res: any, next: any): Promise<void> {
  const user = req.currentUser;
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  const allowed = await hasGroupPermission(user, "add_notes");
  if (!allowed) { res.status(403).json({ error: "Accesso negato: permesso note interne richiesto" }); return; }
  next();
}

router.get("/tickets/:id/notes", requireAuth, requireNoteAccess, async (req, res): Promise<void> => {
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

  const [ticket] = await db.select({ id: ticketsTable.id }).from(ticketsTable).where(
    and(eq(ticketsTable.id, id), orgId != null ? eq(ticketsTable.organizationId, orgId) : undefined)
  );
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
