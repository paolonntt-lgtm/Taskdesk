import { Router, type IRouter } from "express";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db, stickyNotesTable, stickyNoteUserStatesTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const VALID_COLORS = ["yellow", "green", "blue", "pink", "purple"] as const;
const VALID_VISIBILITY = ["private", "group", "users", "all"] as const;

const CreateBody = z.object({
  text: z.string().default(""),
  color: z.enum(VALID_COLORS).default("yellow"),
  visibility: z.enum(VALID_VISIBILITY).default("private"),
  targetGroupName: z.string().nullable().optional(),
  targetUserIds: z.array(z.number().int()).nullable().optional(),
});

const UpdateBody = z.object({
  text: z.string().optional(),
  color: z.enum(VALID_COLORS).optional(),
  visibility: z.enum(VALID_VISIBILITY).optional(),
  targetGroupName: z.string().nullable().optional(),
  targetUserIds: z.array(z.number().int()).nullable().optional(),
});

const StateBody = z.object({
  positionX: z.number().int(),
  positionY: z.number().int(),
  closed: z.boolean(),
});

function parseUserGroups(groups: string | null | undefined): string[] {
  try { return JSON.parse(groups ?? "[]"); } catch { return []; }
}

function parseTargetUserIds(raw: string | null | undefined): number[] {
  try { return JSON.parse(raw ?? "[]"); } catch { return []; }
}

function isNoteVisibleTo(
  note: typeof stickyNotesTable.$inferSelect,
  userId: number,
  userGroups: string[],
): boolean {
  if (note.visibility === "private") return note.createdBy === userId;
  if (note.visibility === "group") {
    return !!note.targetGroupName && userGroups.includes(note.targetGroupName);
  }
  if (note.visibility === "users") {
    const ids = parseTargetUserIds(note.targetUserIds);
    return ids.includes(userId) || note.createdBy === userId;
  }
  if (note.visibility === "all") return true;
  return false;
}

router.get("/sticky-notes", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const userId: number = currentUser.id;
  const orgId: number | null = currentUser.organizationId ?? null;
  const userGroups = parseUserGroups(currentUser.groups);

  const allNotes = await db
    .select()
    .from(stickyNotesTable)
    .where(orgId != null ? eq(stickyNotesTable.organizationId, orgId) : sql`organization_id IS NULL`)
    .orderBy(stickyNotesTable.createdAt);

  const visible = allNotes.filter((n) => isNoteVisibleTo(n, userId, userGroups));
  if (visible.length === 0) { res.json([]); return; }

  const noteIds = visible.map((n) => n.id);
  const states = await db
    .select()
    .from(stickyNoteUserStatesTable)
    .where(and(
      inArray(stickyNoteUserStatesTable.noteId, noteIds),
      eq(stickyNoteUserStatesTable.userId, userId),
    ));
  const stateMap = new Map(states.map((s) => [s.noteId, s]));

  const result = visible.map((note) => {
    const state = stateMap.get(note.id);
    return {
      ...note,
      targetUserIds: parseTargetUserIds(note.targetUserIds),
      posX: state?.positionX ?? 120,
      posY: state?.positionY ?? 120,
      closed: state?.closed ?? false,
    };
  });

  res.json(result);
});

router.post("/sticky-notes", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const { text, color, visibility, targetGroupName, targetUserIds } = parsed.data;

  const [note] = await db
    .insert(stickyNotesTable)
    .values({
      organizationId: currentUser.organizationId ?? null,
      createdBy: currentUser.id,
      text,
      color,
      visibility,
      targetGroupName: targetGroupName ?? null,
      targetUserIds: targetUserIds ? JSON.stringify(targetUserIds) : null,
    })
    .returning();

  res.status(201).json({
    ...note,
    targetUserIds: targetUserIds ?? [],
    posX: 120,
    posY: 120,
    closed: false,
  });
});

router.patch("/sticky-notes/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const currentUser = (req as any).currentUser;
  const parsed = UpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const [existing] = await db
    .select()
    .from(stickyNotesTable)
    .where(eq(stickyNotesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  if (existing.createdBy !== currentUser.id) {
    res.status(403).json({ error: "Only the creator can edit this note" });
    return;
  }

  const updates: Partial<typeof stickyNotesTable.$inferInsert> = {};
  if (parsed.data.text !== undefined) updates.text = parsed.data.text;
  if (parsed.data.color !== undefined) updates.color = parsed.data.color;
  if (parsed.data.visibility !== undefined) updates.visibility = parsed.data.visibility;
  if ("targetGroupName" in parsed.data) updates.targetGroupName = parsed.data.targetGroupName ?? null;
  if ("targetUserIds" in parsed.data) {
    updates.targetUserIds = parsed.data.targetUserIds ? JSON.stringify(parsed.data.targetUserIds) : null;
  }

  const [updated] = await db
    .update(stickyNotesTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(stickyNotesTable.id, id))
    .returning();

  res.json({
    ...updated,
    targetUserIds: parseTargetUserIds(updated.targetUserIds),
  });
});

router.delete("/sticky-notes/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const currentUser = (req as any).currentUser;

  const [existing] = await db
    .select()
    .from(stickyNotesTable)
    .where(eq(stickyNotesTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  if (existing.createdBy !== currentUser.id && currentUser.role !== "admin") {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  await db.delete(stickyNotesTable).where(eq(stickyNotesTable.id, id));
  res.json({ ok: true });
});

router.put("/sticky-notes/:id/state", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const currentUser = (req as any).currentUser;
  const userId: number = currentUser.id;
  const userGroups = parseUserGroups(currentUser.groups);

  const parsed = StateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: String(parsed.error) });
    return;
  }

  const [note] = await db.select().from(stickyNotesTable).where(eq(stickyNotesTable.id, id));
  if (!note || !isNoteVisibleTo(note, userId, userGroups)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { positionX, positionY, closed } = parsed.data;

  await db
    .insert(stickyNoteUserStatesTable)
    .values({ noteId: id, userId, positionX, positionY, closed })
    .onConflictDoUpdate({
      target: [stickyNoteUserStatesTable.noteId, stickyNoteUserStatesTable.userId],
      set: { positionX, positionY, closed, updatedAt: new Date() },
    });

  res.json({ ok: true });
});

export default router;
