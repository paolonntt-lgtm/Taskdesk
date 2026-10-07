import { Router, type IRouter } from "express";
import { and, desc, eq, gt, inArray, lte, or } from "drizzle-orm";
import {
  announcementsTable,
  db,
  groupMembersTable,
  groupsTable,
} from "@workspace/db";
import {
  CreateAnnouncementBody,
  ListActiveAnnouncementsResponse,
  ListAnnouncementsResponse,
  UpdateAnnouncementBody,
  UpdateAnnouncementParams,
  UpdateAnnouncementResponse,
} from "@workspace/api-zod";
import { requireAdmin, requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const announcementFields = {
  id: announcementsTable.id,
  title: announcementsTable.title,
  body: announcementsTable.body,
  targetType: announcementsTable.targetType,
  targetLocation: announcementsTable.targetLocation,
  targetGroupId: announcementsTable.targetGroupId,
  startsAt: announcementsTable.startsAt,
  endsAt: announcementsTable.endsAt,
  createdAt: announcementsTable.createdAt,
  updatedAt: announcementsTable.updatedAt,
};

type AnnouncementInput = {
  title: string;
  body: string;
  targetType: "all" | "location" | "group";
  targetLocation?: string | null;
  targetGroupId?: number | null;
  startsAt: Date;
  endsAt: Date;
};

async function getTargetFields(
  input: AnnouncementInput,
  organizationId: number,
): Promise<{ targetLocation: string | null; targetGroupId: number | null } | null> {
  if (input.targetType === "location") {
    const targetLocation = input.targetLocation?.trim();
    if (!targetLocation) return null;
    return { targetLocation, targetGroupId: null };
  }

  if (input.targetType === "group") {
    const targetGroupId = input.targetGroupId;
    if (!targetGroupId || !Number.isInteger(targetGroupId)) return null;
    const [group] = await db
      .select({ id: groupsTable.id })
      .from(groupsTable)
      .where(and(
        eq(groupsTable.id, targetGroupId),
        eq(groupsTable.organizationId, organizationId),
      ))
      .limit(1);
    if (!group) return null;
    return { targetLocation: null, targetGroupId };
  }

  return { targetLocation: null, targetGroupId: null };
}

function parseId(raw: string | string[]): number | null {
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get("/announcements", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const organizationId = currentUser.organizationId as number | null;
  if (organizationId == null) {
    res.status(403).json({ error: "Organization required" });
    return;
  }

  const announcements = await db
    .select(announcementFields)
    .from(announcementsTable)
    .where(eq(announcementsTable.organizationId, organizationId))
    .orderBy(desc(announcementsTable.createdAt));

  res.setHeader("Cache-Control", "no-cache, private");
  res.json(ListAnnouncementsResponse.parse(announcements));
});

router.get("/announcements/active", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const organizationId = currentUser.organizationId as number | null;
  if (organizationId == null) {
    res.setHeader("Cache-Control", "no-cache, private");
    res.json([]);
    return;
  }

  const memberships = await db
    .select({ groupId: groupMembersTable.groupId })
    .from(groupMembersTable)
    .innerJoin(groupsTable, eq(groupMembersTable.groupId, groupsTable.id))
    .where(and(
      eq(groupMembersTable.userId, currentUser.id),
      eq(groupsTable.organizationId, organizationId),
    ));

  const audienceConditions = [eq(announcementsTable.targetType, "all")];
  if (currentUser.mainLocation) {
    audienceConditions.push(and(
      eq(announcementsTable.targetType, "location"),
      eq(announcementsTable.targetLocation, currentUser.mainLocation),
    )!);
  }
  if (memberships.length > 0) {
    audienceConditions.push(and(
      eq(announcementsTable.targetType, "group"),
      inArray(announcementsTable.targetGroupId, memberships.map(({ groupId }) => groupId)),
    )!);
  }

  const now = new Date();
  const announcements = await db
    .select(announcementFields)
    .from(announcementsTable)
    .where(and(
      eq(announcementsTable.organizationId, organizationId),
      lte(announcementsTable.startsAt, now),
      gt(announcementsTable.endsAt, now),
      or(...audienceConditions),
    ))
    .orderBy(desc(announcementsTable.createdAt));

  res.setHeader("Cache-Control", "no-cache, private");
  res.json(ListActiveAnnouncementsResponse.parse(announcements));
});

router.post("/announcements", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const organizationId = currentUser.organizationId as number | null;
  if (organizationId == null) {
    res.status(403).json({ error: "Organization required" });
    return;
  }

  const parsed = CreateAnnouncementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid announcement", message: parsed.error.message });
    return;
  }
  const input = parsed.data;
  if (!input.title.trim() || !input.body.trim() || input.endsAt <= input.startsAt) {
    res.status(400).json({ error: "Invalid announcement", message: "Title, body, and a valid date range are required." });
    return;
  }

  const target = await getTargetFields(input, organizationId);
  if (!target) {
    res.status(400).json({ error: "Invalid announcement audience" });
    return;
  }

  const [announcement] = await db
    .insert(announcementsTable)
    .values({
      organizationId,
      createdBy: currentUser.id,
      title: input.title.trim(),
      body: input.body.trim(),
      targetType: input.targetType,
      ...target,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    })
    .returning(announcementFields);

  res.status(201).json(announcement);
});

router.put("/announcements/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const organizationId = currentUser.organizationId as number | null;
  const params = UpdateAnnouncementParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: "Invalid announcement ID" });
    return;
  }
  if (organizationId == null) {
    res.status(403).json({ error: "Organization required" });
    return;
  }

  const parsed = UpdateAnnouncementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid announcement", message: parsed.error.message });
    return;
  }
  const input = parsed.data;
  if (!input.title.trim() || !input.body.trim() || input.endsAt <= input.startsAt) {
    res.status(400).json({ error: "Invalid announcement", message: "Title, body, and a valid date range are required." });
    return;
  }

  const target = await getTargetFields(input, organizationId);
  if (!target) {
    res.status(400).json({ error: "Invalid announcement audience" });
    return;
  }

  const [announcement] = await db
    .update(announcementsTable)
    .set({
      title: input.title.trim(),
      body: input.body.trim(),
      targetType: input.targetType,
      ...target,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      updatedAt: new Date(),
    })
    .where(and(
      eq(announcementsTable.id, params.data.id),
      eq(announcementsTable.organizationId, organizationId),
    ))
    .returning(announcementFields);

  if (!announcement) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }

  res.json(UpdateAnnouncementResponse.parse(announcement));
});

router.delete("/announcements/:id", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const organizationId = currentUser.organizationId as number | null;
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid announcement ID" });
    return;
  }
  if (organizationId == null) {
    res.status(403).json({ error: "Organization required" });
    return;
  }

  const [deleted] = await db
    .delete(announcementsTable)
    .where(and(
      eq(announcementsTable.id, id),
      eq(announcementsTable.organizationId, organizationId),
    ))
    .returning({ id: announcementsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Announcement not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
