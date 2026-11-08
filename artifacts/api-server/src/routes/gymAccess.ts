import { Router, type IRouter } from "express";
import { and, eq, gte, lt } from "drizzle-orm";
import { db, clientsTable, gymAccessEventsTable, organizationsTable } from "@workspace/db";
import { requireAdmin, requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const ListQuery = z.object({
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
}).superRefine((query, ctx) => {
  if (new Date(query.from) >= new Date(query.to)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "End must be after start" });
  } else if (new Date(query.to).getTime() - new Date(query.from).getTime() > 32 * 24 * 60 * 60 * 1000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["to"], message: "Date range cannot exceed 32 days" });
  }
});

const CreateBody = z.object({
  clientId: z.number().int().positive(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
});

async function isGymOrganization(organizationId: number): Promise<boolean> {
  const [organization] = await db.select({ profession: organizationsTable.profession })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, organizationId));
  return organization?.profession === "palestre";
}

router.get("/gym-access", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const organizationId = currentUser.organizationId;
  if (organizationId == null) {
    res.status(403).json({ error: "Account has no organization" });
    return;
  }
  if (!await isGymOrganization(organizationId)) {
    res.status(403).json({ error: "Gym access records are only available to gym organizations" });
    return;
  }

  const parsedQuery = ListQuery.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: "Invalid date range", message: parsedQuery.error.message });
    return;
  }
  const from = new Date(parsedQuery.data.from);
  const to = new Date(parsedQuery.data.to);
  const events = await db.select({
    id: gymAccessEventsTable.id,
    personName: gymAccessEventsTable.personName,
    occurredAt: gymAccessEventsTable.occurredAt,
    createdAt: gymAccessEventsTable.createdAt,
  }).from(gymAccessEventsTable)
    .where(and(
      eq(gymAccessEventsTable.organizationId, organizationId),
      gte(gymAccessEventsTable.occurredAt, from),
      lt(gymAccessEventsTable.occurredAt, to),
    ))
    .orderBy(gymAccessEventsTable.occurredAt);

  res.json(events);
});

router.post("/gym-access", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const currentUser = (req as any).currentUser;
  const organizationId = currentUser.organizationId;
  if (organizationId == null) {
    res.status(403).json({ error: "Account has no organization" });
    return;
  }
  if (!await isGymOrganization(organizationId)) {
    res.status(403).json({ error: "Gym access records are only available to gym organizations" });
    return;
  }

  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", message: parsed.error.message });
    return;
  }

  const [client] = await db.select({ name: clientsTable.name })
    .from(clientsTable)
    .where(and(
      eq(clientsTable.id, parsed.data.clientId),
      eq(clientsTable.organizationId, organizationId),
    ))
    .limit(1);
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const [event] = await db.insert(gymAccessEventsTable).values({
    organizationId,
    personName: client.name,
    occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date(),
    createdBy: currentUser.id,
  }).returning({
    id: gymAccessEventsTable.id,
    personName: gymAccessEventsTable.personName,
    occurredAt: gymAccessEventsTable.occurredAt,
    createdAt: gymAccessEventsTable.createdAt,
  });
  res.status(201).json(event);
});

export default router;
